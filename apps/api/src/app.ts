import express from 'express';
import cors from 'cors';

import path from 'path';
import { repositoryMiddleware } from './middlewares/repository';
import authRouter from './routes/auth';
import lessonsRouter from './routes/lessons/index';
import parentRouter from './routes/parent';
import teacherRouter from './routes/teacher';
import collaborativeRouter from './routes/collaborative';
import usersRouter from './routes/users';
import ttsRouter from './routes/tts';
import avatarsRouter from './routes/avatars';
import speechRouter from './routes/speech';
import syncRouter from './routes/sync';

const app = express();

app.set('trust proxy', 1); // Trust only the immediate upstream reverse proxy (prevents IP spoofing)

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(repositoryMiddleware);

// Serve cached TTS audio files statically
app.use(
  '/cache/tts',
  express.static(path.join(__dirname, '../public/cache/tts'), {
    setHeaders: (res) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

app.use('/api/auth', authRouter);
app.use('/api/lessons', lessonsRouter);
app.use('/api/parent', parentRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/collaborative', collaborativeRouter);
app.use('/api/users', usersRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/avatars', avatarsRouter);
app.use('/api/speech', speechRouter);
app.use('/api/sync', syncRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default app;
