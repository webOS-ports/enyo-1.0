// Include stylesheet that hides the print dialog in the printed output.
//
// This used to live as a bare document.write at the end of depends.js. The enyo
// builder does not preserve code in depends.js (see support/enyo-compress/README.md),
// so it has to be a real source file or the print stylesheet is lost when the
// library is bundled.
document.write('<link href="' + enyo.path.rewrite("$enyo-lib/printdialog") + '/css/PrintMedia.css" media="print" rel="stylesheet" type="text/css" />');
