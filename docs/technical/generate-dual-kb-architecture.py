from diagrams import Diagram, Cluster, Edge
from diagrams.aws.engagement import Connect
from diagrams.aws.compute import Lambda
from diagrams.aws.ml import Bedrock
from diagrams.aws.integration import SNS, Eventbridge
from diagrams.aws.storage import S3
from diagrams.aws.database import Dynamodb
from diagrams.aws.management import Cloudwatch
from diagrams.onprem.client import Client, User
from diagrams.onprem.network import Internet

with Diagram("VaidyaVaani - Dual KB Architecture", show=False, direction="LR", filename="VaidyaVaani-Slide8-Architecture"):
    
    with Cluster("Entry Layer"):
        feature = Client("Feature\nPhone")
        smart = Client("Smart\nphone")
        land = User("Landline")
    
    with Cluster("IVR + Location"):
        connect = Connect("Connect\nNova Sonic")
        location = Lambda("Location\n3-Tier")
    
    with Cluster("Intelligence"):
        router = Lambda("Router\n<200ms")
        
        with Cluster("Dual KB"):
            emerg_kb = Bedrock("Emergency\n15 scripts")
            gen_kb = Bedrock("General\n50-200 docs")
        
        claude = Bedrock("Claude 3.5")
    
    with Cluster("Actions"):
        dispatch = Lambda("108/102")
        sms = SNS("SMS")
        hospital = Lambda("Hospital")
        asha = Lambda("ASHA")
        followup = Eventbridge("Follow-up")
        surveil = Lambda("Surveillance")
    
    with Cluster("Storage"):
        s3_store = S3("S3")
        dynamo = Dynamodb("DynamoDB")
        logs = Cloudwatch("Logs")
    
    [feature, smart, land] >> connect
    connect >> location
    location >> router
    
    router >> Edge(color="red", label="Emergency") >> emerg_kb
    router >> Edge(color="green", label="Triage") >> gen_kb
    
    emerg_kb >> claude
    gen_kb >> claude
    
    claude >> [dispatch, sms, hospital, asha, followup, surveil]
    
    [dispatch, sms, hospital, asha, followup, surveil] >> dynamo
    connect >> s3_store
    router >> logs
