const bcrypt = require('bcrypt');

async function checkPassword() {
    const hash = '$2b$10$CaeDC5sz5/LBRes2RFnYru8dg1upiVwuAdglmlX2u8QI.KQBW/ope';
    const password = 'rudwls83';

    const match = await bcrypt.compare(password, hash);
    console.log('Password Match:', match);
}

checkPassword();
