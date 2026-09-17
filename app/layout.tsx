import "./globals.css";
import "./interaction-accessibility.css";
import { EngineeringVoiceProfile } from "@/components/EngineeringVoiceProfile";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <EngineeringVoiceProfile />
        {children}
      </body>
    </html>
  );
}
