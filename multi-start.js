/**
 * Multi-account launcher for Knight Bot.
 *
 * Runs one WhatsApp account per child process (each gets its own session
 * folder, store file and temp folder), so you are not limited to a single
 * account. Everything else — commands, pairing flow, group handling — works
 * exactly as it does for a single account; this file only decides which
 * account each process logs into.
 *
 * Setup:
 *   1. Copy data/accounts.example.json to data/accounts.json
 *   2. List every account you want to run, e.g.:
 *        [
 *          { "id": "akun1", "phoneNumber": "6281234567890" },
 *          { "id": "akun2", "phoneNumber": "6289876543210" }
 *        ]
 *   3. Start all of them with: node multi-start.js   (or: npm run start:multi)
 *   4. A pairing code is printed per account on first run — link it in
 *      WhatsApp (Linked Devices) like you normally would. After that, each
 *      account reconnects on its own using its saved session.
 *
 * Each account's files live under:
 *   session/<id>/              (auth/session, like the single-account ./session)
 *   baileys_store_<id>.json    (that account's message store)
 *   temp_<id>/                 (that account's scratch/download folder)
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

const ACCOUNTS_FILE = path.join(__dirname, 'data', 'accounts.json');
const EXAMPLE_FILE = path.join(__dirname, 'data', 'accounts.example.json');
const RESTART_DELAY_MS = 5000;

function loadAccounts() {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
        console.error(chalk.red(`Tidak ditemukan ${ACCOUNTS_FILE}`));
        console.error(chalk.yellow(`Buat dulu dari contohnya:\n  cp ${path.relative(__dirname, EXAMPLE_FILE)} ${path.relative(__dirname, ACCOUNTS_FILE)}`));
        process.exit(1);
    }

    let accounts;
    try {
        accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
    } catch (err) {
        console.error(chalk.red(`Gagal membaca ${ACCOUNTS_FILE}: ${err.message}`));
        process.exit(1);
    }

    if (!Array.isArray(accounts) || accounts.length === 0) {
        console.error(chalk.red(`${ACCOUNTS_FILE} harus berupa array berisi minimal satu akun.`));
        process.exit(1);
    }

    const seenIds = new Set();
    for (const acc of accounts) {
        if (!acc || typeof acc.id !== 'string' || !acc.id.trim()) {
            console.error(chalk.red('Setiap akun wajib punya "id" (string), contoh: "akun1".'));
            process.exit(1);
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(acc.id)) {
            console.error(chalk.red(`id akun "${acc.id}" tidak valid — gunakan huruf, angka, "-" atau "_" saja.`));
            process.exit(1);
        }
        if (seenIds.has(acc.id)) {
            console.error(chalk.red(`id akun "${acc.id}" duplikat — setiap akun butuh id unik.`));
            process.exit(1);
        }
        seenIds.add(acc.id);
        if (!acc.phoneNumber || typeof acc.phoneNumber !== 'string') {
            console.error(chalk.red(`Akun "${acc.id}" butuh "phoneNumber" (tanpa + atau spasi) untuk pairing code.`));
            process.exit(1);
        }
    }

    return accounts;
}

function prefixStream(stream, label, colorFn) {
    const rl = readline.createInterface({ input: stream });
    rl.on('line', (line) => console.log(colorFn(`[${label}] `) + line));
}

function startAccount(account, colorFn) {
    let shuttingDown = false;

    const launch = () => {
        const child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                ACCOUNT_ID: account.id,
                PHONE_NUMBER: account.phoneNumber,
                SESSION_DIR: path.join('.', 'session', account.id),
                STORE_FILE: path.join('.', `baileys_store_${account.id}.json`),
                BOT_NAME: account.botName || process.env.BOT_NAME || 'KNIGHT BOT',
            },
        });

        prefixStream(child.stdout, account.id, colorFn);
        prefixStream(child.stderr, account.id, colorFn);

        child.on('exit', (code, signal) => {
            if (shuttingDown) return;
            console.log(colorFn(`[${account.id}] `) + chalk.red(`proses berhenti (code=${code} signal=${signal}), restart dalam ${RESTART_DELAY_MS / 1000}s...`));
            setTimeout(launch, RESTART_DELAY_MS);
        });

        runningChildren.add(child);
        child.once('exit', () => runningChildren.delete(child));
    };

    launch();
    return () => { shuttingDown = true; };
}

const COLORS = [chalk.cyan, chalk.green, chalk.magenta, chalk.yellow, chalk.blue, chalk.red];
const runningChildren = new Set();

function main() {
    const accounts = loadAccounts();
    console.log(chalk.bold(`Menjalankan ${accounts.length} akun: ${accounts.map(a => a.id).join(', ')}`));

    const stopFns = accounts.map((account, i) => startAccount(account, COLORS[i % COLORS.length]));

    const shutdown = () => {
        console.log(chalk.yellow('\nMenghentikan semua akun...'));
        stopFns.forEach(stop => stop());
        for (const child of runningChildren) {
            child.kill('SIGTERM');
        }
        setTimeout(() => process.exit(0), 1000);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main();
