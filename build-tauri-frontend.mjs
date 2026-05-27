#!/usr/bin/env node
/**
 * Bereitet das Frontend fuer den Tauri-Build vor.
 *
 * Tauri laedt sein Frontend aus `dist/` (siehe `frontendDist` in
 * src-tauri/tauri.conf.json). Wir nutzen das bereits getestete Standalone-Bundle
 * (alle Module, Sprachen und CSS in EINER HTML-Datei) als dist/index.html – so
 * gibt es im WebView weder fetch- noch ES-Modul-Probleme.
 *
 * Wird von `npm run build:app` (Tauri `beforeBuildCommand`) aufgerufen.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';

execSync('node build-standalone.mjs', { stdio: 'inherit' });
mkdirSync('dist', { recursive: true });
copyFileSync('autounattend-generator.standalone.html', 'dist/index.html');
console.log('Tauri-Frontend bereit: dist/index.html');
