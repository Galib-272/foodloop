import { TEMPLATE_CSV } from '@/lib/csv';

export const GET = () =>
  new Response(TEMPLATE_CSV + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="foodsphere_sales_history_template.csv"',
    },
  });
