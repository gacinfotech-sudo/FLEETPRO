
/**
 * EMERGENCY ADMIN RECOVERY SCRIPT
 * 
 * To use this script when you've lost admin access:
 * 1. Open the terminal in Replit
 * 2. Run: npx tsx server/recovery-script.ts
 * 3. Follow the prompts
 */

import { emergencyAdminPasswordReset, createBackupAdmin } from "./admin-recovery";
import connectDB from "./connectDB";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  try {
    
    // Connect to database
    await connectDB();
    
    const action = await askQuestion(
      "What would you like to do?\n1. Reset existing admin password\n2. Create backup admin user\n3. Create emergency admin from environment\nEnter choice (1, 2, or 3): "
    );
    
    if (action === "1") {
      const newPassword = await askQuestion("Enter new admin password (min 8 chars): ");
      
      if (newPassword.length < 8) {
        process.exit(1);
      }
      
      const confirm = await askQuestion(`⚠️  This will reset the admin password. Type 'CONFIRM' to proceed: `);
      
      if (confirm !== "CONFIRM") {
        process.exit(0);
      }
      
      await emergencyAdminPasswordReset(newPassword);
      
    } else if (action === "2") {
      const userId = await askQuestion("Enter new admin user ID: ");
      const password = await askQuestion("Enter password (min 8 chars): ");
      
      if (password.length < 8) {
        process.exit(1);
      }
      
      await createBackupAdmin(userId, password);
      
    } else if (action === "3") {
      const { createEmergencyAdmin } = await import("./admin-recovery");
      const result = await createEmergencyAdmin();
      
      if (!result) {
      }
      
    } else {
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Recovery failed:", error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
