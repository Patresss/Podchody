import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashPassword } from "./auth.js";

const readline = createInterface({ input: stdin, output: stdout });
try {
  const password = await readline.question("Nowe hasło administratora (min. 10 znaków): ");
  const repeated = await readline.question("Powtórz hasło: ");
  if (password !== repeated) throw new Error("Hasła nie są identyczne.");
  stdout.write(`\nADMIN_PASSWORD_HASH=${await hashPassword(password)}\n`);
} finally {
  readline.close();
}
