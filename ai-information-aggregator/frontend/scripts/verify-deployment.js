#!/usr/bin/env node

/**
 * Deployment verification script
 * Runs comprehensive tests to verify the frontend deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting deployment verification...\n');

// Check if build directory exists
const buildDir = path.join(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  console.error('❌ Build directory not found. Run npm run build first.');
  process.exit(1);
}

console.log('✅ Build directory exists');

// Check critical files
const criticalFiles = [
  'index.html',
  'static/js',
  'static/css',
  'manifest.json'
];

let allFilesExist = true;
criticalFiles.forEach(file => {
  const filePath = path.join(buildDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
    allFilesExist = false;
  }
});

// Check index.html content
const indexPath = path.join(buildDir, 'index.html');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Check for essential elements
  const checks = [
    { name: 'DOCTYPE', pattern: /<!DOCTYPE html>/i },
    { name: 'Root div', pattern: /<div id="root"><\/div>/ },
    { name: 'JS bundle', pattern: /static\/js\/main\.[a-f0-9]+\.js/ },
    { name: 'CSS bundle', pattern: /static\/css\/main\.[a-f0-9]+\.css/ },
    { name: 'Manifest', pattern: /manifest\.json/ }
  ];

  checks.forEach(check => {
    if (check.pattern.test(indexContent)) {
      console.log(`✅ ${check.name} found in index.html`);
    } else {
      console.log(`❌ ${check.name} missing from index.html`);
      allFilesExist = false;
    }
  });
}

// Check bundle sizes
const staticJsDir = path.join(buildDir, 'static/js');
if (fs.existsSync(staticJsDir)) {
  const jsFiles = fs.readdirSync(staticJsDir);
  const mainBundle = jsFiles.find(file => file.startsWith('main.') && file.endsWith('.js'));
  
  if (mainBundle) {
    const bundlePath = path.join(staticJsDir, mainBundle);
    const stats = fs.statSync(bundlePath);
    const sizeKB = Math.round(stats.size / 1024);
    
    console.log(`📦 Main bundle size: ${sizeKB} KB`);
    
    if (sizeKB > 500) {
      console.log('⚠️  Bundle size is large (>500KB). Consider code splitting.');
    } else {
      console.log('✅ Bundle size is reasonable');
    }
  }
}

// Check for source maps (should be disabled in production)
const hasSourceMaps = fs.readdirSync(buildDir, { recursive: true })
  .some(file => file.toString().endsWith('.map'));

if (hasSourceMaps) {
  console.log('⚠️  Source maps found in build. Consider disabling for production.');
} else {
  console.log('✅ No source maps in production build');
}

// Summary
console.log('\n📋 Deployment Verification Summary:');
if (allFilesExist) {
  console.log('✅ All critical files present');
  console.log('🎉 Frontend is ready for deployment!');
  process.exit(0);
} else {
  console.log('❌ Some critical files are missing');
  console.log('🚨 Fix issues before deploying');
  process.exit(1);
}