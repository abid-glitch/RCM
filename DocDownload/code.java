// src/main/java/com/example/worddocument/controller/AutoDownloadController.java
package com.example.worddocument.controller;

import com.example.worddocument.service.WordDocumentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.ByteArrayOutputStream;
import java.util.logging.Logger;

@RestController
public class AutoDownloadController {
    
    private static final Logger logger = Logger.getLogger(AutoDownloadController.class.getName());

    @Autowired
    private WordDocumentService wordDocumentService;

    @GetMapping("/")
    public ResponseEntity<ByteArrayResource> autoDownloadDocument() {
        logger.info("Auto-downloading document...");
        
        try {
            // Default values for the document
            String name = "Default User";
            String email = "user@example.com";
            String phone = "123-456-7890";
            
            ByteArrayOutputStream outputStream = wordDocumentService.generateDocument(name, email, phone);
            
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=document.docx");
            
            ByteArrayResource resource = new ByteArrayResource(outputStream.toByteArray());
            
            logger.info("Document generated successfully with size: " + outputStream.size());
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                    .contentLength(outputStream.size())
                    .body(resource);
                    
        } catch (Exception e) {
            logger.severe("Error generating document: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}

// src/main/java/com/example/worddocument/service/WordDocumentService.java
package com.example.worddocument.service;

import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
public class WordDocumentService {

    public ByteArrayOutputStream generateDocument(String name, String email, String phone) throws Exception {
        XWPFDocument document = new XWPFDocument();
        
        // Create title
        XWPFParagraph title = document.createParagraph();
        title.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun titleRun = title.createRun();
        titleRun.setText("DOCUMENT WITH PROTECTED SECTIONS");
        titleRun.setBold(true);
        titleRun.setFontSize(16);
        
        // Add some spacing
        document.createParagraph();
        
        // Add non-editable section header
        XWPFParagraph nonEditableHeader = document.createParagraph();
        XWPFRun nonEditableHeaderRun = nonEditableHeader.createRun();
        nonEditableHeaderRun.setText("NON-EDITABLE SECTION");
        nonEditableHeaderRun.setBold(true);
        nonEditableHeaderRun.setFontSize(14);
        
        // Add non-editable content with protection
        addNonEditableSection(document, name, email, phone);
        
        // Add some spacing
        document.createParagraph();
        
        // Add editable section header
        XWPFParagraph editableHeader = document.createParagraph();
        XWPFRun editableHeaderRun = editableHeader.createRun();
        editableHeaderRun.setText("EDITABLE SECTION");
        editableHeaderRun.setBold(true);
        editableHeaderRun.setFontSize(14);
        
        // Add editable content
        addEditableSection(document);
        
        // Apply document protection
        applyDocumentProtection(document);
        
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        document.write(outputStream);
        return outputStream;
    }
    
    private void addNonEditableSection(XWPFDocument document, String name, String email, String phone) {
        // Create table for displaying non-editable information
        XWPFTable table = document.createTable(4, 2);
        table.setWidth("100%");
        
        // Set table styles
        CTTblPr tblPr = table.getCTTbl().getTblPr();
        tblPr.getTblW().setW(BigInteger.valueOf(5000));
        
        // Row 1: Date
        XWPFTableRow row1 = table.getRow(0);
        row1.getCell(0).setText("Date:");
        row1.getCell(1).setText(LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")));
        
        // Row 2: Name
        XWPFTableRow row2 = table.getRow(1);
        row2.getCell(0).setText("Name:");
        row2.getCell(1).setText(name != null ? name : "Default User");
        
        // Row 3: Email
        XWPFTableRow row3 = table.getRow(2);
        row3.getCell(0).setText("Email:");
        row3.getCell(1).setText(email != null ? email : "user@example.com");
        
        // Row 4: Phone
        XWPFTableRow row4 = table.getRow(3);
        row4.getCell(0).setText("Phone:");
        row4.getCell(1).setText(phone != null ? phone : "123-456-7890");
        
        // Add legal disclaimer
        XWPFParagraph disclaimer = document.createParagraph();
        XWPFRun disclaimerRun = disclaimer.createRun();
        disclaimerRun.setText("This information is confidential and cannot be modified. All rights reserved.");
        disclaimerRun.setItalic(true);
        disclaimerRun.setFontSize(10);
    }
    
    private void addEditableSection(XWPFDocument document) {
        // Create editable form sections
        XWPFParagraph instruction = document.createParagraph();
        XWPFRun instructionRun = instruction.createRun();
        instructionRun.setText("Please complete the following sections:");
        
        // Add fields to be completed
        String[] formFields = {
            "Comments:",
            "Additional Information:",
            "Requested Changes:"
        };
        
        for (String field : formFields) {
            XWPFParagraph fieldPara = document.createParagraph();
            XWPFRun fieldRun = fieldPara.createRun();
            fieldRun.setText(field);
            fieldRun.setBold(true);
            
            // Add empty paragraph for user input
            document.createParagraph();
            // Add a line for writing
            XWPFParagraph line = document.createParagraph();
            line.setBorderBottom(Borders.SINGLE);
            
            // Add two more empty lines
            document.createParagraph();
            document.createParagraph();
        }
        
        // Add signature field
        XWPFParagraph signaturePara = document.createParagraph();
        XWPFRun signatureRun = signaturePara.createRun();
        signatureRun.setText("Signature: ");
        signatureRun.setBold(true);
        
        // Add date field
        XWPFParagraph datePara = document.createParagraph();
        XWPFRun dateRun = datePara.createRun();
        dateRun.setText("Date: ");
        dateRun.setBold(true);
    }
    
    private void applyDocumentProtection(XWPFDocument document) {
        // Apply protection to only allow editing of form fields
        CTDocument1 ctDocument = document.getDocument();
        CTDocProtect docProtect;
        
        // Check if document protection already exists
        if (ctDocument.isSetDocumentProtection()) {
            docProtect = ctDocument.getDocumentProtection();
        } else {
            docProtect = ctDocument.addNewDocumentProtection();
        }
        
        docProtect.setEdit(STDocProtect.FORMS);
        docProtect.setFormatting(false);
        docProtect.setEnforcement(true);
        
        // Set a password (optional)
        String password = "password"; // You should use a more secure method to generate/store passwords
        docProtect.setAlgorithmName("SHA-1");
        docProtect.setHashValue(password.getBytes());
        docProtect.setSalt(password.getBytes());
    }
}

// src/main/resources/application.properties
# Server configuration
server.port=8080

# Debugging configuration
logging.level.org.springframework.web=DEBUG
logging.level.com.example=DEBUG
logging.level.root=INFO

# Disable Whitelabel error page
server.error.whitelabel.enabled=false
server.error.include-stacktrace=always
server.error.include-message=always

# Content type configuration
spring.mvc.contentnegotiation.favor-parameter=true
spring.mvc.contentnegotiation.media-types.docx=application/vnd.openxmlformats-officedocument.wordprocessingml.document

# Maximum file upload size
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB
