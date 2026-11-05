# 2D Online Multiplayer Open-World Shooter Game

A browser-based, 2D side-scrolling multiplayer open-world shooting game inspired by Mini Militia. Built with Phaser 3, TypeScript, Colyseus, Express.js, and MariaDB / MySQL via Prisma ORM.

## Key Features
- **No Installation Required**: Runs smoothly in any modern desktop and mobile browser.
- **Server-Authoritative Multiplayer**: Real-time position validation, jump/gravity physics, projectile simulation, hit detection, health, and respawn logic via Colyseus.
- **5 Soldier Characters**: Ranger, Spec-Ops Commando, Desert Recon, Arctic Hunter, and Cyber Merc with customizable color palettes.
- **5 Weapons**: Tactical Pistol, M4 Carbine, Combat Shotgun, AWP Sniper Rifle, and Grenade Launcher with explosive splash physics.
- **Forest Island Map**: Broad side-scrolling interconnected level with watchtowers, underground bunkers, suspension bridges, platforms, and spawn points.
- **Multiplayer Modes**: Free Roam, Solo Deathmatch, Team Deathmatch, and Private Rooms with shareable 6-character room codes.
- **Responsive Controls**: Full keyboard/mouse controls on desktop and dual touch virtual joysticks + on-screen buttons on mobile.
- **Synthesized Audio Engine**: Web Audio API procedural sound engine with realistic firearm cracks, shell ejections, footsteps, explosions, and jump whooshes. Zero asset 404s.

---

## Technology Stack
- **Frontend**: HTML5, CSS3, TypeScript, Phaser 3, Lucide Icons, Vite
- **Game Server & API**: Node.js, Express.js, Colyseus Framework (WebSockets), bcryptjs, jsonwebtoken
- **Database**: MariaDB 11.8+ / MySQL 8.0+ via Prisma ORM
- **Shared Code**: Shared constants, types, weapon definitions, map geometry in `/shared`

---

## Database Configuration (MariaDB / MySQL)

### 1. Requirements
- MariaDB 11.8+ or MySQL 8.0+
- Character encoding: `utf8mb4`
- Default port: `3306`

### 2. Environment Variables (`server/.env`)
```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL="mysql://gameuser:STRONG_PASSWORD@localhost:3306/openworld_game"
JWT_SECRET="super-tactical-secret-key-change-in-production-2026"
JWT_EXPIRES_IN="7d"
CLIENT_URL="http://localhost:3000"
```

### 3. Database Initialization

#### Option A: Using Docker Compose (Quickest)
```bash
docker compose up -d
```

#### Option B: Native MariaDB / MySQL
1. Connect to your MariaDB/MySQL server:
```bash
mariadb -u root -p
# or
mysql -u root -p
```
2. Run the initialization script:
```sql
SOURCE server/prisma/schema.sql;
```
3. Generate Prisma client & push schema:
```bash
cd server
npm run db:generate
npm run db:push
```

### 4. Backup & Restore Instructions

#### Backup Database
```bash
# MariaDB
mariadb-dump -u gameuser -p --databases openworld_game --single-transaction --quick > backup_openworld_game.sql

# MySQL
mysqldump -u gameuser -p openworld_game --single-transaction --quick > backup_openworld_game.sql
```

#### Restore Database
```bash
# MariaDB
mariadb -u gameuser -p openworld_game < backup_openworld_game.sql

# MySQL
mysql -u gameuser -p openworld_game < backup_openworld_game.sql
```

### 5. MariaDB / MySQL Connection Troubleshooting

- **Error: `ECONNREFUSED 127.0.0.1:3306`**
  - Verify that the MariaDB / MySQL service is running.
  - Windows: Check Services (`services.msc`) -> look for `MariaDB` or `MySQL`.
  - Linux: `sudo systemctl status mariadb` or `sudo systemctl status mysql`.
- **Error: `Access denied for user 'gameuser'@'localhost'`**
  - Verify your password in `server/.env`.
  - Run `GRANT ALL PRIVILEGES ON openworld_game.* TO 'gameuser'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD'; FLUSH PRIVILEGES;`.
- **Character Encoding Warnings**
  - Ensure MariaDB / MySQL is configured with `character-set-server=utf8mb4` and `collation-server=utf8mb4_unicode_ci`.

---

## Quick Start (Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Shared Protocol
```bash
npm run build:shared
```

### 3. Start Both Backend & Frontend
```bash
npm run dev
```
- Frontend: `http://localhost:3000`
- Backend API & Colyseus Server: `http://localhost:3001`

---

## Controls

### Desktop
- **A / Left Arrow**: Move Left
- **D / Right Arrow**: Move Right
- **W / Up Arrow / Space**: Jump / Jetpack Boost
- **Mouse**: 360-Degree Aim
- **Left Mouse Click**: Shoot
- **R**: Reload Weapon
- **Q**: Switch Weapon
- **T / Enter**: Open Chat

### Mobile
- **Left Thumb Joystick**: Movement & Jump
- **Right Thumb Joystick**: 360-Degree Aim & Auto/Tap Fire
- **Reload Button**: Reload
- **Weapon Swap Button**: Cycle Weapons
- **Chat Button**: Toggle On-screen Chat Input

