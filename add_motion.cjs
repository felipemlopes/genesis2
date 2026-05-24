const fs = require('fs');

let appContent = fs.readFileSync('./App.tsx', 'utf8');

// Add motion import if not there
if (!appContent.includes("import { motion, AnimatePresence } from 'framer-motion'")) {
    appContent = appContent.replace(
        "import React, { useState, useEffect, useCallback, useMemo } from 'react';", 
        "import React, { useState, useEffect, useCallback, useMemo } from 'react';\nimport { motion, AnimatePresence } from 'framer-motion';"
    );
}

// Ensure the `import` was actually added (in case the existing import statement is slightly different)
if (!appContent.includes("import { motion, AnimatePresence } from 'framer-motion'")) {
    appContent = "import { motion, AnimatePresence } from 'framer-motion';\n" + appContent;
}

// Find the start of the switch block and wrap
appContent = appContent.replace(
    /\{activeTab !== 'support' && activeTab !== 'learn' && activeTab !== 'mind_metrics' && \(/,
    '<AnimatePresence mode="wait">\n             <motion.div\n                key={activeTab}\n                initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}\n                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}\n                exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}\n                transition={{ duration: 0.4, ease: "easeOut" }}\n                className="w-full flex-1 flex flex-col"\n             >\n           {activeTab !== \'support\' && activeTab !== \'learn\' && activeTab !== \'mind_metrics\' && ('
);

appContent = appContent.replace(
    /           <footer className="mt-12 mb-6 border-t border-white\/5 /,
    '             </motion.div>\n             </AnimatePresence>\n           <footer className="mt-12 mb-6 border-t border-white/5 '
);

fs.writeFileSync('./App.tsx', appContent, 'utf8');
console.log('Framer motion and animations added.');
