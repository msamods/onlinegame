// REST API Client for Online Game

export interface UserProfile {
  id: string;
  user_id: string;
  selected_character: string;
  character_color: string;
  level: number;
  experience: number;
  coins: number;
}

export interface UserStats {
  id: string;
  user_id: string;
  kills: number;
  deaths: number;
  matches_played: number;
  matches_won: number;
}

export interface AuthUser {
  id: string;
  username: string;
  profile?: UserProfile;
  statistics?: UserStats;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

class ApiService {
  private baseUrl: string = '/api';
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('tactical_auth_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('tactical_auth_token', token);
    } else {
      localStorage.removeItem('tactical_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data as T;
  }

  public async register(body: {
    username: string;
    password: string;
    confirmPassword?: string;
    selectedCharacter?: string;
    characterColor?: string;
  }): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    this.setToken(data.token);
    return data;
  }

  public async login(body: { username: string; password: string }): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    this.setToken(data.token);
    return data;
  }

  public async getProfile(): Promise<AuthUser> {
    return this.request<AuthUser>('/auth/me');
  }

  public async updateCharacter(data: { selectedCharacter: string; characterColor: string }): Promise<any> {
    return this.request('/users/character', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async getLeaderboard(): Promise<any[]> {
    return this.request('/users/leaderboard');
  }

  public async getRooms(): Promise<any[]> {
    return this.request('/rooms');
  }

  public async createPrivateRoom(body: {
    roomName: string;
    roomType: string;
    mapName?: string;
    maxPlayers?: number;
    password?: string;
  }): Promise<any> {
    return this.request('/rooms/create', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  public async joinByCode(body: { roomCode: string; password?: string }): Promise<any> {
    return this.request('/rooms/join-by-code', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  public logout() {
    this.setToken(null);
  }
}

export const api = new ApiService();

