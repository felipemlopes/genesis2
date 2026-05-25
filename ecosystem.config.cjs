module.exports = {
    apps: [
        {
            name: "meu-next",
            script: "npm",
            args: "run preview -- --host 0.0.0.0 --port 3010",
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};