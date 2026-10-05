#!/usr/bin/env node
/**
 * Restablece la contraseña de un usuario y desbloquea su cuenta (uso administrativo en el servidor).
 *
 *   node server/tools/reset-password.mjs correo@dominio [nueva-contraseña]
 *
 * Sin segundo argumento se genera una contraseña aleatoria y se muestra una sola vez.
 * Respeta DATA_DIR / DB_PATH del entorno (en producción: sudo -u isup DATA_DIR=/var/lib/isup node …).
 */
import bcrypt from 'bcryptjs';
import { get, run } from '../db.js';
import { randomPassword } from '../seed.js';
import { checkPassword } from '../lib.js';

const [email, given] = process.argv.slice(2);
if (!email) {
  console.error('Uso: node server/tools/reset-password.mjs correo@dominio [nueva-contraseña]');
  process.exit(1);
}
const user = get('SELECT id, email, first_name, last_name, role FROM users WHERE lower(email) = lower(?) OR lower(code) = lower(?)', email.trim(), email.trim());
if (!user) {
  console.error(`No existe ningún usuario con el correo o código "${email}".`);
  process.exit(1);
}
const password = given || randomPassword();
const problem = checkPassword(password);
if (problem) {
  console.error(problem);
  process.exit(1);
}
run('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL, active = 1 WHERE id = ?', bcrypt.hashSync(password, 10), user.id);
run("INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES (NULL, 'password.reset', 'user', ?, ?, 'servidor')", user.id, JSON.stringify({ by: 'reset-password.mjs' }));
console.log(`Contraseña restablecida para ${user.first_name} ${user.last_name} (${user.email}, ${user.role}).`);
console.log(`Nueva contraseña: ${password}`);
console.log('Pídele que la cambie en Mi perfil tras ingresar.');
