import { PageHeader } from "@/components/shared/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";

/** Create new employee page */
export default function NewEmployeePage() {
  return (
    <div>
      <PageHeader
        title="Add Employee"
        description="Create a new employee profile and user account"
      />
      <EmployeeForm />
    </div>
  );
}
