#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

// load .env
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// Run `expo start` with any extra args forwarded
const args = process.argv.slice(2);

const child = spawn('npx', ['expo', 'start', ...args], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
});

child.on('exit', (code) => process.exit(code));
