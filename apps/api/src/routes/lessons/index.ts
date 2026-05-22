import { Router } from 'express';
import attemptsRouter from './attempts';
import hintsRouter from './hints';
import progressRouter from './progress';
import recommendationsRouter from './recommendations';

const router = Router();

router.use('/', attemptsRouter);
router.use('/', hintsRouter);
router.use('/', progressRouter);
router.use('/', recommendationsRouter);

export default router;
