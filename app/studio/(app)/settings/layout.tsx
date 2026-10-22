import { getMember } from "@/lib/auth";
import { Mono, PageContainer, PageHeader } from "@/components/ui/primitives";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({ children }: LayoutProps<"/studio/settings">) {
  const member = await getMember();
  return (
    <PageContainer>
      <PageHeader eyebrow={<Mono>{member.studioName}</Mono>} title="Settings" />
      <SettingsTabs />
      {children}
    </PageContainer>
  );
}
