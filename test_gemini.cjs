const { scanChartMetadata } = require("./dist_test/geminiService.js");

async function run() {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const mockFile = {
        type: "image/jpeg",
        size: 1000,
        name: "test.jpg",
        arrayBuffer: async () => new ArrayBuffer(0)
    };
    
    // We mock FileReader inside node ? It doesn't exist!
    global.FileReader = class {
        constructor() {}
        readAsDataURL() {
            setTimeout(() => {
                this.result = "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
                this.onloadend();
            }, 100);
        }
    };
    
    try {
        console.log("Starting scan...");
        const meta = await scanChartMetadata(mockFile);
        console.log("Meta:", meta);
    } catch(e) {
        console.error("Error:", e);
    }
}
run();
