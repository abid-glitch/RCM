import { AfterViewInit, ChangeDetectionStrategy, Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { COMMITTEE_PACKAGE_STEPS } from '@committeePackage/repository/services/committee-package';
import { CommitteeExecutiveSummary } from '@committeePackage/repository/services/committee-package/interfaces/committee-package-patch.interface';
import { DapperFormComponent } from '@moodys/emtn-dyna-forms/dapper-form/src/components/dapper-form/dapper-form.component';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { TranslateService } from '@ngx-translate/core';
import { EmtnChattyPayloads } from '@committeePackage/shared/types/emtn-chatty/emtn-chatty-payloads';
import { map, Observable, startWith, Subject } from 'rxjs';
import { AppRoutes } from '@app/routes/routes';
import { ExecutiveSummaryModel } from '@app/executive-summary/models/executive-summary-model';
import { BlueTableData } from '@moodys/blue-ng';
import { LockUnlockService } from '@app/lock-unlock/services/lock-unlock.service';
import { tap } from 'rxjs/operators';
import { UnSavedChanges, UnSavedContext } from '@shared/models/UnSavedChanges';

@Component({
    selector: 'app-executive-summary',
    templateUrl: './executive-summary.component.html',
    styleUrls: ['./executive-summary.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None
})
export class ExecutiveSummaryComponent implements OnInit, AfterViewInit, UnSavedChanges {
    private readonly caseId: string = this._activatedRoute.snapshot.parent?.parent.params['caseId'];
    protected emtnChatty$ = new Subject<EmtnChattyPayloads>();
    appRoutes = AppRoutes;

    protected readonly committeePackageSteps = [COMMITTEE_PACKAGE_STEPS.ExecutiveSummary];

    fields: FormlyFieldConfig[] = [];
    model!: ExecutiveSummaryModel;
    executiveSummaryTransaction = this._activatedRoute.snapshot.data['executiveSummary']['data'];
    isFinalized = this._activatedRoute.snapshot.data['executiveSummary']['isFinalized'];

    transaction = this.executiveSummaryTransaction['executiveSummary'];
    entity: any[] = this.executiveSummaryTransaction['entities'];
    executiveSummary$!: Observable<CommitteeExecutiveSummary>;
    @ViewChild('dapperFormRef') dapperFormRef!: DapperFormComponent;

    countryCode: string;
    countryCeilings: BlueTableData = [];
    isCountryCeilingsEnabled = true;
    lockUnlock$ = this._lockUnlockService.lockUnlock$;
    hasUnsavedChanges = false;

    constructor(
        private readonly translateService: TranslateService,
        private readonly _activatedRoute: ActivatedRoute,
        private readonly _lockUnlockService: LockUnlockService
    ) {}

    getUnSavedContext(): UnSavedContext {
        return { value: this._mapFormValue(this.dapperFormRef.form.value) as never, caseId: this.caseId };
    }

    ngOnInit(): void {
        this.initializeFormFields();
        this.initializeFormModel();
        this.initializeCountryCeilings();
    }

    ngAfterViewInit() {
        this.initializeFormValueChange();
    }

    initializeCountryCeilings(): void {
        this.countryCeilings = this.getCountryCeiling(this.entity);
    }

    initializeFormFields(): void {
        this.fields = [
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.proposedRationale.title'),
                            'props.subtitle': this.translateService.stream('executiveSummary.proposedRationale.note')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'proposedRationale',
                                type: 'blueRichText',
                                props: {
                                    testId: 'proposedRationale'
                                }
                            }
                        ]
                    }
                ]
            },
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.discussionHighlights.title'),
                            'props.subtitle': this.translateService.stream('executiveSummary.discussionHighlights.note')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'discussionHighlights',
                                type: 'blueRichText',
                                props: {
                                    testId: 'discussionHighlights'
                                }
                            }
                        ]
                    }
                ]
            },
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream(
                                'executiveSummary.factorsImpactingOutlookAndRatingSection.title'
                            ),
                            'props.subtitle': this.translateService.stream('executiveSummary.outlookImpact.note')
                        }
                    }
                ]
            },

            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.outlookImpact.title')
                        }
                    }
                ]
            },
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.current')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'priorOutlookImpact',
                                type: 'blueRichText',
                                props: {
                                    testId: 'priorOutlookImpact'
                                }
                            }
                        ]
                    }
                ]
            },

            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.proposed')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'outlookImpact',
                                type: 'blueRichText',
                                props: {
                                    testId: 'outlookImpact'
                                }
                            }
                        ]
                    }
                ]
            },

            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.factorsToUpgrade.title')
                        }
                    }
                ]
            },
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.current')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'priorFactorsToUpgrade',
                                type: 'blueRichText',
                                props: {
                                    testId: 'priorFactorsToUpgrade'
                                }
                            }
                        ]
                    }
                ]
            },

            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.proposed')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'factorsToUpgrade',
                                type: 'blueRichText',
                                props: {
                                    testId: 'factorsToUpgrade'
                                }
                            }
                        ]
                    }
                ]
            },
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.factorsToDowngrade.title')
                        }
                    }
                ]
            },
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.current')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'priorFactorsToDowngrade',
                                type: 'blueRichText',
                                props: {
                                    testId: 'priorFactorsToDowngrade'
                                }
                            }
                        ]
                    }
                ]
            },

            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.proposed')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'factorsToDowngrade',
                                type: 'blueRichText',
                                props: {
                                    testId: 'factorsToDowngrade'
                                }
                            }
                        ]
                    }
                ]
            },

            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream(
                                'executiveSummary.creditStrengthsAndChallengesSection.title'
                            )
                        }
                    }
                ]
            },
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.creditStrengths.title')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'creditStrengths',
                                type: 'blueRichText',
                                props: {
                                    testId: 'creditStrengths'
                                }
                            }
                        ]
                    }
                ]
            },
            {
                wrappers: ['blueCard'],
                fieldGroup: [
                    {
                        wrappers: ['blueCardHeader'],
                        expressions: {
                            'props.title': this.translateService.stream('executiveSummary.creditChallenges.title')
                        }
                    },
                    {
                        wrappers: ['blueCardContent'],
                        fieldGroup: [
                            {
                                key: 'creditChallenges',
                                type: 'blueRichText',
                                props: {
                                    testId: 'creditChallenges'
                                }
                            }
                        ]
                    }
                ]
            }
        ];
    }

    initializeFormModel(): void {
        if (this.transaction) {
            this.model = {
                ...this.transaction
            };
        } else {
            this.model = {
                proposedRationale: '',
                discussionHighlights: '',
                outlookImpact: '',
                priorOutlookImpact: '',
                factorsToUpgrade: '',
                priorFactorsToUpgrade: '',
                factorsToDowngrade: '',
                priorFactorsToDowngrade: '',
                creditStrengths: '',
                creditChallenges: ''
            };
        }
    }

    initializeFormValueChange(): void {
        if (this.dapperFormRef) {
            this.executiveSummary$ = this.dapperFormRef.form.valueChanges.pipe(
                tap(() => (this.hasUnsavedChanges = true)),
                startWith(this.model),
                map((formValue) => this._mapFormValue(formValue))
            );
        }
    }

    private _mapFormValue(formValue: ExecutiveSummaryModel): CommitteeExecutiveSummary {
        return {
            component: COMMITTEE_PACKAGE_STEPS.ExecutiveSummary,
            executiveSummary: formValue
        };
    }

    private getRating(ratings: any[], currency: string): string {
        const rating = ratings.find((r: any) => r.currency === currency);
        return rating ? rating.value : '';
    }

    private getCountryCeilingTableData(sovereign: any, domicile: any) {
        this.countryCode = domicile?.code;
        return [
            {
                data: {
                    localSovereignRating: this.getRating(sovereign?.ratings || [], 'DOMESTIC'),
                    foreignSovereignRating: this.getRating(sovereign?.ratings || [], 'FOREIGN'),
                    localCountryCeiling: this.getRating(domicile?.ceilings || [], 'DOMESTIC'),
                    foreignCountryCeiling: this.getRating(domicile?.ceilings || [], 'FOREIGN')
                }
            }
        ];
    }

    private getCountryCeiling(entities: any[]) {
        const org = entities.find((entity: any) => entity.type === 'ORGANIZATION');
        const domicile = org?.domicile;
        const sovereign = org?.sovereign;
        return this.getCountryCeilingTableData(sovereign, domicile);
    }

    onSaveComplete() {
        this.hasUnsavedChanges = false;
    }
}
