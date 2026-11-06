import { PageHeader } from '@/components/app/ui';
import { AssistantChat } from '@/components/app/assistant-chat';
import { requireUser } from '@/lib/auth';
import { INDEX_INFO } from '@/lib/rag/search';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ask FoodLoop — FoodLoop' };

const SUGGESTIONS: Record<string, string[]> = {
  donor: ['How cold must refrigerated food be kept until pickup?', 'Which allergens should I list?', 'What happens after a donor accepts a request?', 'Which food category wastes the most?'],
  recipient: ['How can an organization become verified?', 'What happens after a donor accepts a request?', 'Which rules must an organization pass before matching?', 'Does FoodLoop guarantee food safety?'],
  volunteer: ['What should a volunteer do if a pickup goes wrong?', 'How does food collection work?', 'Can a volunteer cancel a donation?', 'Who can see my phone number?'],
  admin: ['What accuracy does the waste risk model reach?', 'What data was the matching model trained on?', 'What can happen to a scheduled donation?', 'Does pickup distance change delivery success?'],
};

export default function AssistantPage() {
  const user = requireUser();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="AI assistant"
        title="Ask FoodLoop"
        description="Answers come only from FoodLoop’s own guidelines, policies, help articles and AI model reports, with the sources shown. If the documents do not cover a question, the assistant says so instead of guessing."
      />
      <AssistantChat suggestions={SUGGESTIONS[user.role]} chunks={INDEX_INFO.chunks} />
    </div>
  );
}
