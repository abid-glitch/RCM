 public markCaseAsSaved(caseId : string) : void{
        if(!caseId) return;

        const currentSavedCases = this.savedCasesSubject.getValue()
        this.savedCasesSubject.next(currentSavedCases);
    }

    public isCaseSaved(caseId: string):boolean{
        if(!caseId) return false;
        return this.savedCasesSubject.getValue().has(caseId)
    }
