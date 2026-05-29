
export interface Company {
  id: string;
  name: string;
  employer_name: string;
  employer_email: string;
  employer_phone?: string;
  created_at: string;
}

export interface CompanySearchResult {
  found: boolean;
  company?: Company;
  error?: string;
}

export async function searchCompany(
  companyName: string
): Promise<CompanySearchResult> {
  if (!companyName || companyName.trim().length < 2) {
    return {
      found: false,
      error: "Company name must be at least 2 characters",
    };
  }

  try {
    const response = await fetch("/api/company/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ companyName: companyName.trim() }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        found: false,
        error: errorData.error || "Failed to search for company",
      };
    }

    const data = await response.json();
    
    if (!data.found) {
      return {
        found: false,
      };
    }

    return {
      found: true,
      company: data.company,
    };
  } catch (err) {
    console.error("Company search error:", err);
    return {
      found: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}

/**
 * Submit employer onboarding request
 * Called when employee can't find their company
 */
export async function submitEmployerOnboardingRequest(data: {
  employeeName: string;
  employeeEmail: string;
  employeePhone: string;
  companyName: string;
  employerName: string;
  employerEmail: string;
  employerPhone: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/employer-onboarding-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Failed to submit request",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("Onboarding request error:", err);
    return {
      success: false,
      error: "Network error. Please try again.",
    };
  }
}