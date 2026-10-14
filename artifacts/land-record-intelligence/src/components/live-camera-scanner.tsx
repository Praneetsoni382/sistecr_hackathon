import React from "react";
import { DocumentScannerModal, DocumentScannerModalProps } from "./document-scanner-modal";

export function LiveCameraScannerModal(props: DocumentScannerModalProps) {
  return <DocumentScannerModal {...props} />;
}

export { DocumentScannerModal };
