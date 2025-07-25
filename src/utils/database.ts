import Database from 'better-sqlite3';
import path from 'path';

export interface StudySession {
  id: number;
  userId: string;
  guildId: string;
  subject: string;
  startTime: number;
  endTime: number | null;
  notes: string | null;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'study_data.db');
    const dbDir = path.dirname(dbPath);
    
    if (!require('fs').existsSync(dbDir)) {
      require('fs').mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        subject TEXT,
        startTime INTEGER NOT NULL,
        endTime INTEGER,
        notes TEXT
      )
    `;
    this.db.exec(createTableQuery);
  }

  startStudySession(userId: string, guildId: string, subject: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO study_sessions (userId, guildId, subject, startTime)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, guildId, subject, Date.now());
  }

  getCurrentSession(userId: string, guildId: string): StudySession | null {
    const stmt = this.db.prepare(`
      SELECT * FROM study_sessions 
      WHERE userId = ? AND guildId = ? AND endTime IS NULL
    `);
    return stmt.get(userId, guildId) as StudySession | null;
  }

  endStudySession(userId: string, guildId: string, notes?: string): StudySession | null {
    const session = this.getCurrentSession(userId, guildId);
    if (!session) return null;

    const stmt = this.db.prepare(`
      UPDATE study_sessions 
      SET endTime = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), notes || null, session.id);
    
    return this.db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(session.id) as StudySession;
  }

  forceEndSession(userId: string, guildId: string): void {
    const stmt = this.db.prepare(`
      UPDATE study_sessions 
      SET endTime = startTime
      WHERE userId = ? AND guildId = ? AND endTime IS NULL
    `);
    stmt.run(userId, guildId);
  }

  getActiveStudySessions(guildId: string): StudySession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM study_sessions 
      WHERE guildId = ? AND endTime IS NULL
      ORDER BY startTime ASC
    `);
    return stmt.all(guildId) as StudySession[];
  }

  getCompletedSessions(userId: string, guildId: string, period: 'today' | 'week' | 'month' | 'all'): StudySession[] {
    let timeFilter = '';
    const now = Date.now();
    
    switch (period) {
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        timeFilter = ` AND startTime >= ${todayStart.getTime()}`;
        break;
      case 'week':
        timeFilter = ` AND startTime >= ${now - (7 * 24 * 60 * 60 * 1000)}`;
        break;
      case 'month':
        timeFilter = ` AND startTime >= ${now - (30 * 24 * 60 * 60 * 1000)}`;
        break;
      case 'all':
      default:
        timeFilter = '';
        break;
    }

    const stmt = this.db.prepare(`
      SELECT * FROM study_sessions 
      WHERE userId = ? AND guildId = ? AND endTime IS NOT NULL${timeFilter}
      ORDER BY startTime DESC
    `);
    return stmt.all(userId, guildId) as StudySession[];
  }

  getRankingData(guildId: string, period: 'today' | 'week' | 'month' | 'all'): Array<{userId: string, totalTime: number}> {
    let timeFilter = '';
    const now = Date.now();
    
    switch (period) {
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        timeFilter = ` AND startTime >= ${todayStart.getTime()}`;
        break;
      case 'week':
        timeFilter = ` AND startTime >= ${now - (7 * 24 * 60 * 60 * 1000)}`;
        break;
      case 'month':
        timeFilter = ` AND startTime >= ${now - (30 * 24 * 60 * 60 * 1000)}`;
        break;
      case 'all':
      default:
        timeFilter = '';
        break;
    }

    const stmt = this.db.prepare(`
      SELECT userId, SUM(endTime - startTime) as totalTime
      FROM study_sessions 
      WHERE guildId = ? AND endTime IS NOT NULL${timeFilter}
      GROUP BY userId
      HAVING totalTime > 0
      ORDER BY totalTime DESC
      LIMIT 10
    `);
    return stmt.all(guildId) as Array<{userId: string, totalTime: number}>;
  }

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseManager();