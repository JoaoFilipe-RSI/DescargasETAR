const bcrypt = require('bcryptjs');

const password = 'Descargas123!';

bcrypt.hash(password, 12).then(hash => {
  console.log('Hash para "Descargas123!":', hash);
  process.exit(0);
}).catch(err => {
  console.error('Erro ao gerar hash:', err);
  process.exit(1);
});
