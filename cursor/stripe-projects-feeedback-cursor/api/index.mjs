import 'dotenv/config';
import { buildApp } from '../lib/create-app.mjs';

let appPromise;

function getApp() {
  if (!appPromise) {
    appPromise = buildApp();
  }
  return appPromise;
}

export default function handler(req, res) {
  getApp()
    .then((app) => {
      app(req, res);
    })
    .catch((err) => {
      console.error('buildApp failed:', err);
      if (!res.headersSent) {
        res.status(500).type('text').send('Server failed to initialize.');
      }
    });
}
