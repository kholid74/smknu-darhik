/// <reference types="astro/client" />
import type { Principal } from './lib/rbac';
import type { Session } from './lib/auth';

declare global {
  namespace App {
    interface Locals {
      // Diisi middleware untuk request /admin: identitas + izin efektif dari DB.
      session?: Session;
      principal?: Principal;
    }
  }
}

export {};
