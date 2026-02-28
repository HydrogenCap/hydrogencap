import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
      pageNumber: number;
      startPageNumber: number;
    };
  }
}