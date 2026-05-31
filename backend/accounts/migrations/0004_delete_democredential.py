from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_demo_credential"),
    ]

    operations = [
        migrations.DeleteModel(
            name="DemoCredential",
        ),
    ]
