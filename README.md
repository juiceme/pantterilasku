# pantterilasku

A multiuser node.js invoice/bill creation utility handy for generating and emailing PDF-formatted invoices to multiple recipients.
Primary target audience is treasurers of sports teams who need to regularily send bills to their teams.
The name "Pantterilasku" comes from the floorball team "Järvenpään Pantterit" which was inspiration for the application.

## Description

Pantterilasku automates creating invoices/bills for multiple recipients. There is a PDF template that is filled automatically by recipient data and itemized list of billable products/services and mailed to the recipients.

Input data for the recipients and items are stored as JSON files. Web-interface enables adding items separately for each recipient.

Pantterilasku supports multiple users, each having only view of the customers they have credentials for.

## Installation

Pantterilasku requires websocket, pdfkit, emailjs and archiver npm modules. You can install all depencencies by "npm install"
The repository also clones AES library and datastorage as submodules, You need to install those by "git submodule init; git submodule update"

## Features

* PDF templating
* Recipients managed in JSON file
* Item list managed in JSON file
* Web frontend to manage, generate and batch-email invoices/bills
* eb frontend to manage customer list and list of itemized bills.
* Uses AES-CTR encryption between server and client to defeat man-in-the-middle attacks.
* Preview for generated PDF invoices in the browser
* Automatic batch mailing of invoices
* Integrated user management with password recovery
  
## Coming soon!

* Probably more enhancements as I think them up :)
    
## Documentation

None whatsoever :)

## License

Pantterilasku is available under the GPLv3 license.
