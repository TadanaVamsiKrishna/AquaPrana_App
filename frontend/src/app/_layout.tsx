// import { Stack } from "expo-router";
// import { AquaGptFab } from "../components/aqua-gpt-fab";
// import { AquaChatProvider } from "../context/aqua-chat-context";
// import "../i18n";

// export default function RootLayout() {
//   return (
//     <AquaChatProvider>
//       <Stack
//         screenOptions={{
//           headerShown: false,
//         }}
//       />
//       <AquaGptFab />
//     </AquaChatProvider>
//   );
// }

import { useEffect } from "react";
import { Stack } from "expo-router";
import { AquaGptFab } from "../components/aqua-gpt-fab";
import { AquaChatProvider } from "../context/aqua-chat-context";
import { loadStoredLanguage } from "../i18n";
//import "../i18n";

export default function RootLayout() {
  useEffect(() => {
    loadStoredLanguage();
  }, []);

  return (
    <AquaChatProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <AquaGptFab />
    </AquaChatProvider>
  );
}

