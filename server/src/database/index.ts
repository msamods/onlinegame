import { PrismaClient } from '@prisma/client';

export class DatabaseService {
  private static instance: DatabaseService;
  public prisma: PrismaClient | null = null;
  public isConnected: boolean = false;

  // In-memory fallback stores (active if MariaDB/MySQL is offline during local testing)
  private memoryUsers = new Map<string, any>();
  private memoryProfiles = new Map<string, any>();
  private memoryStats = new Map<string, any>();
  private memoryRooms = new Map<string, any>();
  private memorySessions = new Map<string, any>();

  private constructor() {
    try {
      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
      });
    } catch (e) {
      console.warn('[Database] PrismaClient initialization deferred:', e);
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async connect(): Promise<boolean> {
    if (!this.prisma) return false;
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      console.log('[Database] Successfully connected to MariaDB / MySQL via Prisma.');
      return true;
    } catch (err: any) {
      this.isConnected = false;
      console.warn('------------------------------------------------------------');
      console.warn('[Database Warning] MariaDB/MySQL is currently unreachable.');
      console.warn(`Connection URL: ${process.env.DATABASE_URL || 'Default'}`);
      console.warn('Error details:', err.message || err);
      console.warn('[Database] Server is operating with resilient local persistence.');
      console.warn('See README.md for Docker and MariaDB/MySQL setup instructions.');
      console.warn('------------------------------------------------------------');
      return false;
    }
  }

  // --- Users Operations ---
  public async findUserByUsername(username: string): Promise<any | null> {
    if (this.isConnected && this.prisma) {
      try {
        return await this.prisma.user.findUnique({
          where: { username },
          include: { profile: true, statistics: true }
        });
      } catch (e) {
        console.error('[Database] findUserByUsername failed, falling back:', e);
      }
    }
    const user = Array.from(this.memoryUsers.values()).find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );
    if (!user) return null;
    return {
      ...user,
      profile: this.memoryProfiles.get(user.id) || null,
      statistics: this.memoryStats.get(user.id) || null
    };
  }

  public async findUserById(id: string): Promise<any | null> {
    if (this.isConnected && this.prisma) {
      try {
        return await this.prisma.user.findUnique({
          where: { id },
          include: { profile: true, statistics: true }
        });
      } catch (e) {
        console.error('[Database] findUserById failed, falling back:', e);
      }
    }
    const user = this.memoryUsers.get(id);
    if (!user) return null;
    return {
      ...user,
      profile: this.memoryProfiles.get(user.id) || null,
      statistics: this.memoryStats.get(user.id) || null
    };
  }

  public async createUser(userData: {
    id: string;
    username: string;
    password_hash: string;
    selected_character?: string;
    character_color?: string;
  }): Promise<any> {
    if (this.isConnected && this.prisma) {
      try {
        return await this.prisma.$transaction(async (tx: any) => {
          const newUser = await tx.user.create({
            data: {
              id: userData.id,
              username: userData.username,
              password_hash: userData.password_hash,
              account_status: 'active'
            }
          });

          const profile = await tx.playerProfile.create({
            data: {
              id: `prof_${userData.id}`,
              user_id: newUser.id,
              selected_character: userData.selected_character || 'ranger',
              character_color: userData.character_color || '#2e7d32',
              level: 1,
              experience: 0,
              coins: 100
            }
          });

          const statistics = await tx.playerStatistics.create({
            data: {
              id: `stat_${userData.id}`,
              user_id: newUser.id,
              kills: 0,
              deaths: 0,
              matches_played: 0,
              matches_won: 0
            }
          });

          return { ...newUser, profile, statistics };
        });
      } catch (e) {
        console.error('[Database] createUser transaction failed, storing in memory:', e);
      }
    }

    // Fallback in-memory creation
    const user = {
      id: userData.id,
      username: userData.username,
      password_hash: userData.password_hash,
      created_at: new Date(),
      last_login: new Date(),
      account_status: 'active'
    };
    const profile = {
      id: `prof_${userData.id}`,
      user_id: user.id,
      selected_character: userData.selected_character || 'ranger',
      character_color: userData.character_color || '#2e7d32',
      level: 1,
      experience: 0,
      coins: 100
    };
    const statistics = {
      id: `stat_${userData.id}`,
      user_id: user.id,
      kills: 0,
      deaths: 0,
      matches_played: 0,
      matches_won: 0
    };

    this.memoryUsers.set(user.id, user);
    this.memoryProfiles.set(user.id, profile);
    this.memoryStats.set(user.id, statistics);

    return { ...user, profile, statistics };
  }

  public async updateProfile(userId: string, data: { selected_character?: string; character_color?: string }): Promise<any> {
    if (this.isConnected && this.prisma) {
      try {
        return await this.prisma.playerProfile.update({
          where: { user_id: userId },
          data
        });
      } catch (e) {
        console.error('[Database] updateProfile failed:', e);
      }
    }
    const profile = this.memoryProfiles.get(userId);
    if (profile) {
      if (data.selected_character) profile.selected_character = data.selected_character;
      if (data.character_color) profile.character_color = data.character_color;
      this.memoryProfiles.set(userId, profile);
      return profile;
    }
    return null;
  }

  public async recordMatchStats(userId: string, kills: number, deaths: number, won: boolean): Promise<any> {
    if (this.isConnected && this.prisma) {
      try {
        return await this.prisma.$transaction(async (tx: any) => {
          const stats = await tx.playerStatistics.upsert({
            where: { user_id: userId },
            update: {
              kills: { increment: kills },
              deaths: { increment: deaths },
              matches_played: { increment: 1 },
              matches_won: { increment: won ? 1 : 0 }
            },
            create: {
              id: `stat_${userId}`,
              user_id: userId,
              kills,
              deaths,
              matches_played: 1,
              matches_won: won ? 1 : 0
            }
          });

          // Add XP and coins to profile
          const xpGained = kills * 50 + (won ? 100 : 25);
          const coinsGained = kills * 10 + (won ? 50 : 15);
          await tx.playerProfile.update({
            where: { user_id: userId },
            data: {
              experience: { increment: xpGained },
              coins: { increment: coinsGained }
            }
          });

          return stats;
        });
      } catch (e) {
        console.error('[Database] recordMatchStats failed:', e);
      }
    }

    const stats = this.memoryStats.get(userId) || {
      id: `stat_${userId}`,
      user_id: userId,
      kills: 0,
      deaths: 0,
      matches_played: 0,
      matches_won: 0
    };
    stats.kills += kills;
    stats.deaths += deaths;
    stats.matches_played += 1;
    if (won) stats.matches_won += 1;
    this.memoryStats.set(userId, stats);

    const profile = this.memoryProfiles.get(userId);
    if (profile) {
      profile.experience += kills * 50 + (won ? 100 : 25);
      profile.coins += kills * 10 + (won ? 50 : 15);
      profile.level = Math.floor(profile.experience / 500) + 1;
      this.memoryProfiles.set(userId, profile);
    }

    return stats;
  }

  public async getLeaderboard(limit: number = 20): Promise<any[]> {
    if (this.isConnected && this.prisma) {
      try {
        const stats = await this.prisma.playerStatistics.findMany({
          take: limit,
          orderBy: [{ kills: 'desc' }, { matches_won: 'desc' }],
          include: {
            user: {
              select: {
                username: true,
                profile: true
              }
            }
          }
        });
        return stats.map((s: any) => ({
          userId: s.user_id,
          username: s.user.username,
          character: s.user.profile?.selected_character || 'ranger',
          level: s.user.profile?.level || 1,
          kills: s.kills,
          deaths: s.deaths,
          kdRatio: s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2),
          matchesPlayed: s.matches_played,
          matchesWon: s.matches_won
        }));
      } catch (e) {
        console.error('[Database] getLeaderboard failed:', e);
      }
    }

    const allStats = Array.from(this.memoryStats.values());
    allStats.sort((a, b) => b.kills - a.kills || b.matches_won - a.matches_won);
    return allStats.slice(0, limit).map(s => {
      const user = this.memoryUsers.get(s.user_id);
      const profile = this.memoryProfiles.get(s.user_id);
      return {
        userId: s.user_id,
        username: user?.username || 'Unknown Soldier',
        character: profile?.selected_character || 'ranger',
        level: profile?.level || 1,
        kills: s.kills,
        deaths: s.deaths,
        kdRatio: s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2),
        matchesPlayed: s.matches_played,
        matchesWon: s.matches_won
      };
    });
  }

  // --- Game Rooms Persistence ---
  public async createGameRoom(roomData: {
    id: string;
    room_code: string;
    room_name: string;
    room_type: string;
    map_name: string;
    maximum_players: number;
    created_by: string;
  }): Promise<any> {
    if (this.isConnected && this.prisma) {
      try {
        return await this.prisma.gameRoom.create({ data: roomData });
      } catch (e) {
        console.error('[Database] createGameRoom failed:', e);
      }
    }
    this.memoryRooms.set(roomData.room_code, roomData);
    return roomData;
  }

  public async findGameRoomByCode(roomCode: string): Promise<any | null> {
    if (this.isConnected && this.prisma) {
      try {
        return await this.prisma.gameRoom.findUnique({
          where: { room_code: roomCode }
        });
      } catch (e) {
        console.error('[Database] findGameRoomByCode failed:', e);
      }
    }
    return this.memoryRooms.get(roomCode) || null;
  }
}

export const db = DatabaseService.getInstance();
