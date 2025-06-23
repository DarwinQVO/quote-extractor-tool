#!/usr/bin/env node

/**
 * Database initialization script for Railway deployment
 * Creates database tables if they don't exist
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Initializing database...');

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.log('📝 Setting DATABASE_URL to default SQLite location');
  process.env.DATABASE_URL = 'file:./dev.db';
}

console.log('📊 Database URL:', process.env.DATABASE_URL);

// Check if database file exists (for SQLite)
const dbPath = './dev.db';
const dbExists = fs.existsSync(dbPath);
console.log(`📁 Database file ${dbExists ? 'exists' : 'does not exist'}: ${dbPath}`);

// Run database push to create tables
console.log('🚀 Creating database schema...');
const dbPush = spawn('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
  stdio: 'inherit',
  env: process.env,
});

dbPush.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Database initialization failed with code ${code}`);
    process.exit(1);
  }
  
  console.log('✅ Database initialized successfully!');
  
  // Generate Prisma client
  console.log('🔧 Generating Prisma client...');
  const generate = spawn('npx', ['prisma', 'generate'], {
    stdio: 'inherit',
    env: process.env,
  });
  
  generate.on('close', (generateCode) => {
    if (generateCode !== 0) {
      console.error(`❌ Prisma client generation failed with code ${generateCode}`);
      process.exit(1);
    }
    
    console.log('✅ Prisma client generated successfully!');
    console.log('🎉 Database initialization complete!');
  });
});