import IORedis from "ioredis";
import Redis from "ioredis-mock";
import fs from "fs";
import path from "path";
import { COMMANDS } from "../types/commands";
import { augmentedRedis } from "../types";

export class RedisClient {
  private static instance: augmentedRedis;
  private static isMocked: boolean = false;

  static enableMocking() {
    this.isMocked = true;
    this.instance = undefined as any;
  }

  static disableMocking() {
    this.isMocked = false;
    this.instance = undefined as any;
  }

  static getInstance(): augmentedRedis {
    if (!RedisClient.instance) {
      // Use mock Redis if testing
      RedisClient.instance = this.isMocked
        ? (new Redis() as augmentedRedis)
        : (new IORedis() as augmentedRedis);

      try {
        // Register Lua scripts
        const scriptsDir = path.join(__dirname, "../scripts");

        // Loop through all commands and load their scripts
        Object.values(COMMANDS).forEach((command) => {
          const scriptPath = path.join(scriptsDir, `${command.name}.lua`);

          if (!fs.existsSync(scriptPath)) {
            throw new Error(
              `Script file not found for command: ${command.name}`
            );
          }

          const scriptContent = fs.readFileSync(scriptPath, "utf8");

          RedisClient.instance.defineCommand(command.name, {
            numberOfKeys: command.keys,
            lua: scriptContent,
          });
        });
        console.log(
          `Loaded Lua scripts for ${Object.keys(COMMANDS).length} commands`
        );
      } catch (error) {
        console.error("Failed to load Lua scripts:", error);
        throw error; // Re-throw to make script loading failures more obvious
      }
    }
    return RedisClient.instance;
  }
}
