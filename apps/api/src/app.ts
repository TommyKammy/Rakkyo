import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth';
import lessonsRouter from './routes/lessons';
import parentRouter from './routes/parent';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/lessons', lessonsRouter);
app.use('/api/parent', parentRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default app;
