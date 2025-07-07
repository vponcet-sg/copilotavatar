#!/usr/bin/env node

/**
 * Cleanup Script for Copilot Studio Speech Avatar Project
 * 
 * This script removes unnecessary files identified through code analysis:
 * - Backup/alternative App files that aren't used
 * - Unused components that aren't imported anywhere
 * - Unused services that aren't imported anywhere
 * - Empty or unused CSS files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define files to remove
const filesToRemove = [
  // Backup/Alternative App files (only App.tsx is actually used in main.tsx)
  'src/App_backup.tsx',
  'src/App_new.tsx', 
  'src/App_modern.tsx', // This one is empty
  
  // Unused CSS files
  'src/App_clean.css', // Empty file
  
  // Unused components (not imported in any active code)
  'src/components/AvatarPlayer.tsx', // Only AzureAvatarPlayer is used
  'src/components/HybridAvatar.tsx', // Not imported anywhere
  'src/components/LiveAvatar.tsx', // Not imported anywhere
  'src/components/InitializationButton.tsx', // Not imported anywhere
  'src/components/LanguageSelector.tsx', // Not imported anywhere
  
  // Unused services (not imported in any active code)
  'src/services/AvatarService.ts', // Only used in HybridAvatarService which is also unused
  'src/services/FallbackAvatarService.ts', // Not imported anywhere
  'src/services/HybridAvatarService.ts', // Not imported anywhere
  'src/services/InitializationService.ts', // Not imported anywhere
  'src/services/LiveAvatarService.ts', // Not imported anywhere
];

// Project root directory
const projectRoot = __dirname;

console.log('🧹 Starting cleanup of unnecessary files...\n');

let removedCount = 0;
let skippedCount = 0;

filesToRemove.forEach(relativePath => {
  const fullPath = path.join(projectRoot, relativePath);
  
  try {
    if (fs.existsSync(fullPath)) {
      // Get file stats to show size
      const stats = fs.statSync(fullPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      
      fs.unlinkSync(fullPath);
      console.log(`✅ Removed: ${relativePath} (${sizeKB} KB)`);
      removedCount++;
    } else {
      console.log(`⚠️  File not found: ${relativePath}`);
      skippedCount++;
    }
  } catch (error) {
    console.error(`❌ Error removing ${relativePath}:`, error.message);
    skippedCount++;
  }
});

console.log(`\n📊 Cleanup Summary:`);
console.log(`   ✅ Files removed: ${removedCount}`);
console.log(`   ⚠️  Files skipped: ${skippedCount}`);
console.log(`   📁 Total processed: ${filesToRemove.length}`);

// Show remaining important files
console.log('\n🎯 Active files remaining:');
console.log('   📱 Main App: src/App.tsx');
console.log('   📱 Entry: src/main.tsx');
console.log('   🎨 Styles: src/App.css, src/index.css');
console.log('   📋 Types: src/types/index.ts');

console.log('\n🧩 Active Components:');
console.log('   - AzureAvatarPlayer.tsx');
console.log('   - ConversationHistory.tsx'); 
console.log('   - AvatarTroubleshooting.tsx');
console.log('   - SettingsModal.tsx');
console.log('   - UIComponents.tsx');

console.log('\n⚙️  Active Services:');
console.log('   - SpeechService.ts');
console.log('   - BotService.ts');
console.log('   - AzureAvatarRealTimeService.ts');
console.log('   - ConfigService.ts');

if (removedCount > 0) {
  console.log('\n🎉 Cleanup completed successfully!');
  console.log('💡 Tip: Run "npm run build" to verify everything still works correctly.');
} else {
  console.log('\n🤔 No files were removed. They may have already been cleaned up.');
}
