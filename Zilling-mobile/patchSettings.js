const fs = require('fs');

const path = 'd:/Zippy/Kwiq Bill Files/Kwiq_Bill_demo/Zilling-mobile/src/pages/Settings/SettingsPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// Use string replacement
const targetCaseMatch = `      case 'contact':`;
const endCaseMatch = `      case 'logout':`;

let startIndex = content.indexOf(targetCaseMatch);
if (startIndex !== -1) {
  let endIndex = content.indexOf(endCaseMatch, startIndex);
  if (endIndex !== -1) {
    let replacedBlock = `      case 'contact':
        return (
          <View style={styles.tabContent}>
            <ContactComponent />
          </View>
        );
`;
    content = content.substring(0, startIndex) + replacedBlock + content.substring(endIndex);
  } else {
    console.error("End case not found");
  }
} else {
  console.error("Target case not found");
}

let importStr = `import ManagerPinGate from './ManagerPinGate';
import ContactComponent from './Settingscomponents/Contact';`;
content = content.replace(`import ManagerPinGate from './ManagerPinGate';`, importStr);

fs.writeFileSync(path, content, 'utf8');
console.log("Success");
