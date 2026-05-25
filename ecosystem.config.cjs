module.exports = {
    apps: [
        {
            name: "meu-next",
            script: "npm",
            args: "run start",
            env: {
                PORT: 3010,
                NODE_ENV: "production"
            }
        }
    ]
};
