import { PageHeader } from '@/components/app/ui';
import { AssistantChat } from '@/components/app/assistant-chat';
import { requireUser } from '@/lib/auth';
import { INDEX_INFO } from '@/lib/rag/search';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ask FoodSphere — FoodSphere AI' };

const SUGGESTIONS: Record<string, string[]> = {
  donor: ['How cold must refrigerated food be kept until pickup?', 'Which allergens should I list?', 'How do I import my sales history?', 'Which food category wastes the most?'],
  recipient: ['How can an organization become verified?', 'What happens after a donor accepts a request?', 'Who can see my contact details?', 'Does FoodSphere AI guarantee food safety?'],
  volunteer: ['What should a volunteer do if a pickup goes wrong?', 'How does food collection work?', 'How cold must refrigerated food be kept?', 'Who can see my phone number?'],
  admin: ['What accuracy does the waste risk model reach?', 'What data was the matching model trained on?', 'Which organizations complete donations most often?', 'Does pickup distance change delivery success?'],
};

export default function AssistantPage() {
  const user = requireUser();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="AI assistant"
        title="Ask FoodSphere"
        description="Answers come only from FoodSphere’s own guidelines, policies, help articles and AI model reports, with the sources shown. If the documents do not cover a question, the assistant says so instead of guessing."
      />
      <AssistantChat suggestions={SUGGESTIONS[user.role]} chunks={INDEX_INFO.chunks} />
    </div>
  );
}
