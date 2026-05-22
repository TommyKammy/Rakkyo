import app from './app';
import { preBakeTTS } from './utils/ttsPreBaker';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Rakkyo API Server running on port ${PORT}`);
  preBakeTTS();
});
