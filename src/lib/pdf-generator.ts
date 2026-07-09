
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Transaction } from '@/components/dashboard/expense-tracker/AddTransactionForm';

// Extend the jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const currencySymbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
};


export const generateExpenseReportPDF = (transactions: Transaction[], farmerName: string) => {
  const doc = new jsPDF();

  // 1. Add Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('eKheti - Expense Report', 14, 22);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Farmer: ${farmerName}`, 14, 30);
  const reportDate = new Date();
  doc.text(`Report Date: ${reportDate.toLocaleDateString()}`, 14, 36);

  // 2. Summary
  const currentMonth = reportDate.getMonth();
  const currentYear = reportDate.getFullYear();
  const monthTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  const totalIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const netBalance = totalIncome - totalExpense;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Summary for ${reportDate.toLocaleString('default', { month: 'long' })} ${currentYear}`, 14, 50);
  
  const summaryBody = [
      ['Total Income (Aay)', `${currencySymbols.INR}${totalIncome.toLocaleString()}`],
      ['Total Expense (Kharcha)', `${currencySymbols.INR}${totalExpense.toLocaleString()}`],
      ['Net Balance (Profit/Loss)', `${currencySymbols.INR}${netBalance.toLocaleString()}`],
  ];

  doc.autoTable({
      startY: 55,
      head: [['Category', 'Amount']],
      body: summaryBody,
      theme: 'grid',
      styles: {
          font: 'helvetica',
          // Note: fillColor in didDrawCell doesn't work as expected in all versions, but we can set text color.
      },
      headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0] },
      columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.row.index === 2) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(netBalance >= 0 ? 'green' : 'red');
        } else {
            doc.setTextColor('black'); // Reset to black for other cells
        }
      }
  });


  // 3. Transactions Table
  if(monthTransactions.length > 0) {
    const tableColumn = ["Date", "Type", "Category", "Description", "Amount"];
    const tableRows: (string|number)[][] = [];

    monthTransactions.forEach(t => {
        const transactionData = [
            new Date(t.date).toLocaleDateString(),
            t.type.charAt(0).toUpperCase() + t.type.slice(1),
            t.category,
            t.description || '-',
            `${currencySymbols[t.currency]}${t.amount.toLocaleString()}`,
        ];
        tableRows.push(transactionData);
    });

    doc.autoTable({
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }, // Blue header
    });
  } else {
    doc.text("No transactions recorded for this month.", 14, (doc as any).lastAutoTable.finalY + 15);
  }
  

  // 4. Footer
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 35, doc.internal.pageSize.height - 10);
  }

  // 5. Save the PDF
  doc.save(`eKheti_Expense_Report_${reportDate.getFullYear()}_${reportDate.getMonth()+1}.pdf`);
};
