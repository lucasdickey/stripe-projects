import 'dotenv/config';
import { buildApp } from './lib/create-app.mjs';

const app = await buildApp();
const port = Number(process.env.PORT) || 3847;
app.listen(port, () => {
  console.log(`stripe-projects-feedback listening on http://127.0.0.1:${port}`);
});
