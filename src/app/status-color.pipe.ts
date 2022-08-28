import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";

@Pipe({
  name: "statusColor"
})
export class StatusColorPipe implements PipeTransform {
  constructor(private sanitized: DomSanitizer) {}

  transform(value: any, args?: any): any {
    if (value === "Alive") {
      var str = value.replace("Alive", "<mat-icon>home</mat-icon>");
      return this.sanitized.bypassSecurityTrustHtml(str);
    }
    return null;
  }
}
