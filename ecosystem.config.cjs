module.exports = {
    apps: [
        {
            name: "meu-next",
            script: "npm",
            args: "run preview -- --host 0.0.0.0 --port 3010",
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "genesis_monitor",
            script: "python3",
            args: "monitor/monitor_worker.py",
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000
        },
        {
            name: "worker_radar_news",
            script: "python3",
            args: "monitor/worker_radar_news.py",
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000
        }
    ]
};
