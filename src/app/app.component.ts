import {
  AfterViewInit, Component, OnDestroy, OnInit, ViewChild
} from "@angular/core";
import { BehaviorSubject, Observable, of } from "rxjs";

import { HttpClient, HttpParams } from "@angular/common/http";
import { FormBuilder, FormControl, FormGroup } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from "rxjs/operators";


//Models for the Data required to be handled

export interface Origin {
  [key: string]: any;
}

export interface Location {
  [key: string]: any;
}

export interface Character {
  id: number;
  name: string;
  status: string;
  species: string;
  type: string;
  gender: string;
  origin: Origin;
  location: Location;
  image: string;
  episode: any[];
  url: string;
  created: Date;
}

export interface HttpRequest {
  info?: {
    count: number;
    pages: number;
    next: string;
    prev: string;
  };
  results?: Character[];
}

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  //Material Paginator used for pagination
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  characters$!: Observable<any>;
  characterDataSource!: MatTableDataSource<Character>;
  characterDatabase = new HttpDatabase(this.httpClient);
  searchTerm$ = new BehaviorSubject<string>("");
  resultsEmpty$ = new BehaviorSubject<boolean>(false);
  status = "";
  resultsLength = 0;
  orderBy: '' | 'episode' | 'name' = '';
  orderDir: 'asc' | 'desc' = 'asc';
  sortedData: any[] = [];

  //Search filters grouped together
  filterFormGroup!: FormGroup;
  searchField = new FormControl("");

  constructor(
    private httpClient: HttpClient,
    private fb: FormBuilder
  ) {

  }
  ngAfterViewInit(): void {
    //Loading the characters based on the pagination as soon as view is loaded
    this.paginator.page.subscribe(() => {
      this.characterDatabase
        .getCharacters(this.searchTerm$.value, this.status, this.paginator.pageIndex)
        .subscribe((response: HttpRequest) => {
          this.characterDataSource = new MatTableDataSource(response.results as any[]);
          this.resultsLength = response.info?.count as number;
          // this.characterDataSource.paginator = this.paginator;
          this.characters$ = this.characterDataSource.connect();
        });
    });

  }

  ngOnInit() {
    //empty filter on content intialisation
    this.filterFormGroup = this.fb.group({});
    //populating data
    this.loadData();
  }

  ngOnDestroy() {
    if (this.characterDataSource) {
      //as soon as component destroys unhook the material table
      this.characterDataSource.disconnect();
    }
  }

  loadData() {
    this.characterDatabase
      .search(this.searchTerm$)
      .subscribe((response) => {
        //populater character data and apply filters
        this.updateCharacters(response);
        this.applyFilter();
      });
  }

  updateCharacters(response: any) {
    if (!response.info || !response.results) {
      //Behaviour subject emiting live updates on every call to check if results are empty or not
      this.resultsEmpty$.next(true)
      return
    }
    this.resultsEmpty$.next(false)
    this.resultsLength = response.info?.count;
    //populating the mat table with the data provided by the API endpoint
    this.characterDataSource = new MatTableDataSource(response.results as any[]);

    this.characterDataSource.paginator = this.paginator;
    this.characters$ = this.characterDataSource.connect();
  }


  applyFilter() {
    const filterValue = this.status;
    this.characterDataSource.filter = filterValue.trim().toLowerCase();
    this.characterDataSource.paginator = this.paginator;
    if (this.characterDataSource.paginator) {
      //go to first page of paginator when filters are applied
      this.characterDataSource.paginator.firstPage();
    }
  }

  applyFilterFromDatabase(event: any) {
    //filtering data using the new values and updates the characters array
    this.characterDatabase.getCharacters(this.searchTerm$.value, event.value).subscribe(data => {
      this.updateCharacters(data);
    })
  }

  //Sorting mechanism for sorting data based on multiple cases
  reOrder() {
    let orderedData = this.characterDataSource.data;
    switch (this.orderBy) {
      case 'name':
        orderedData = orderedData.sort((a, b) => compare(a.name, b.name, this.orderDir === 'asc'))
        break;
      case 'episode':
        orderedData = orderedData.sort((a, b) => {
          a.episode.sort();
          const latestEpisodeForA = a.episode[a.episode.length - 1];
          const latestEpisodeForB = b.episode[b.episode.length - 1];
          return compare(latestEpisodeForA, latestEpisodeForB, this.orderDir === 'desc');
        })
        break;
    }

    this.characterDataSource = new MatTableDataSource(orderedData);

    this.characterDataSource.paginator = this.paginator;
    this.characters$ = this.characterDataSource.connect();
  }

  updateResponse(response: string) {
    //updating reactive form values 
    this.searchField.patchValue(response);
    this.searchTerm$.next(response);
  }

  sortData() {
    console.log(this.characterDataSource);
  }
}

//service injector for making http requests
export class HttpDatabase {
  constructor(private _httpClient: HttpClient) { }

  //using observable to debouncing the request on every key stroke
  search(terms: Observable<string>) {
    return terms.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(term =>
        this.getCharacters(term).pipe(
          catchError(() => {
            return of({ info: null, results: null });
          })
        )
      ),
    );
  }

  //API call to get the characters
  getCharacters(
    name: string = "",
    status: string = "",
    page: number = 0
  ): Observable<HttpRequest> {
    const apiUrl = "https://rickandmortyapi.com/api/character";
    return this._httpClient.get<HttpRequest>(apiUrl, {
      params: new HttpParams()
        .set('name', name)
        .set('status', status)
        .set('page', (page + 1).toString())
    });
  }
}

//sort the data based on the current state
function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
