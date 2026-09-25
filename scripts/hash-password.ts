import { hashPassword } from '../src/lib/password';

const pw = process.argv.slice(2).join(' ');
if (!pw) {
  console.error("Usage: npm run hash-password -- 'your password'");
  process.exit(1);
}
console.log(hashPassword(pw));
