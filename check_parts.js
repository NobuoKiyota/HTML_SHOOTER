
const fs = require('fs');
try {
    const data = fs.readFileSync('js/settings_data.js', 'utf8');
    const hasPartTemplates = data.includes('PART_TEMPLATES');
    console.log('Has PART_TEMPLATES:', hasPartTemplates);

    if (hasPartTemplates) {
        // Simple extraction to see what's inside
        const start = data.indexOf('PART_TEMPLATES');
        const end = data.indexOf('},', start + 2000); // reduced range
        console.log('Snippet:', data.substring(start, start + 500));
    }
} catch (e) {
    console.error(e);
}
