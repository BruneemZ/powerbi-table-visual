const fs = require('fs');
const path = require('path');

// Create a simple 20x20 PNG icon for Power BI - table icon
const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAAIRJREFUOE/tkjEKACAIRfv+h3YJ2qLBIZpEcPDDT/xRxMyqmVU5Z865aGaD8/7gnPfmnI/W2uScT0TkFhFxRMQSkbO19ieE8AshfEII34UQvgshfOec+845973W+qy1Pmut7VJKKaWUY0ppp5RSSikbpdRaSllrrSul1LqUsnqt9UdrfXmt9a+1frTWBzO7AMenS6cVWgoGAAAAAElFTkSuQmCC';

const iconBuffer = Buffer.from(iconBase64, 'base64');
const iconPath = path.join(__dirname, 'assets', 'icon.png');

fs.writeFileSync(iconPath, iconBuffer);
console.log('Icon created:', iconPath);
console.log('Size:', iconBuffer.length, 'bytes');
