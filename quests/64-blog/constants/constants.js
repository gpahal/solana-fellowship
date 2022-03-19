const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SLASH = path.sep;

export const programKeyfileName = `target/deploy/blog-keypair.json`;
export const programKeypairFile = path.resolve(
    `${__dirname}${SLASH}${programKeyfileName}`,
);
