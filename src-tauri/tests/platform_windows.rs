#![cfg(windows)]

use privault_ui_lib::platform::secure_directory;
use std::process::Command;

fn current_identity() -> String {
    let output = Command::new("whoami")
        .output()
        .expect("whoami should be available on Windows");
    assert!(output.status.success(), "whoami failed");
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

#[test]
fn secure_directory_removes_inheritance_and_grants_only_current_user() {
    let directory = tempfile::TempDir::new().expect("temporary directory should be created");
    let path = directory.path();

    std::fs::create_dir_all(path).expect("test directory should exist");
    secure_directory(path).expect("directory permissions should be configured");

    let output = Command::new("icacls")
        .arg(path)
        .output()
        .expect("icacls should be available on Windows");
    assert!(output.status.success(), "icacls query failed");
    let report = String::from_utf8_lossy(&output.stdout);

    let identity = current_identity();
    assert!(
        report.contains(&identity),
        "current user should have an explicit ACE\n{report}"
    );
    assert!(
        report.contains("(F)"),
        "current user should have full control\n{report}"
    );
    for inherited_principal in ["Everyone", "Authenticated Users", "BUILTIN\\Users"] {
        assert!(
            !report.contains(inherited_principal),
            "inherited principal {inherited_principal} should not remain\n{report}"
        );
    }
}
